#include <sepol/policydb/policydb.h>
#include <sepol/policydb/avtab.h>
#include <sepol/policydb/util.h>
#include <sepol/policydb/services.h>
#include <cil/cil.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <regex.h>
#include <emscripten.h>

/**
 * SELinux Policy Analysis Bridge for WebAssembly
 */

typedef struct {
    sepol_policydb_t *db;
} policy_handle_t;

EMSCRIPTEN_KEEPALIVE
policy_handle_t* api_load_policy(void *data, size_t len) {
    sepol_policydb_t *db = NULL;
    sepol_policy_file_t *pf = NULL;

    if (sepol_policydb_create(&db) < 0) return NULL;
    if (sepol_policy_file_create(&pf) < 0) {
        sepol_policydb_free(db);
        return NULL;
    }

    sepol_policy_file_set_mem(pf, (char *)data, len);

    if (sepol_policydb_read(db, pf) < 0) {
        sepol_policy_file_free(pf);
        sepol_policydb_free(db);
        return NULL;
    }

    sepol_policy_file_free(pf);

    policy_handle_t *h = malloc(sizeof(policy_handle_t));
    h->db = db;
    return h;
}

EMSCRIPTEN_KEEPALIVE
policy_handle_t* api_load_cil(const char *cil_data, size_t len) {
    cil_db_t *cil_db = NULL;
    sepol_policydb_t *db = NULL;

    cil_db_init(&cil_db);
    if (!cil_db) return NULL;

    cil_set_log_level(CIL_ERR);

    if (cil_add_file(cil_db, "policy.cil", cil_data, len) != SEPOL_OK) {
        cil_db_destroy(&cil_db);
        return NULL;
    }

    if (cil_compile(cil_db) != SEPOL_OK) {
        cil_db_destroy(&cil_db);
        return NULL;
    }

    if (cil_build_policydb(cil_db, &db) != SEPOL_OK) {
        cil_db_destroy(&cil_db);
        return NULL;
    }

    cil_db_destroy(&cil_db);

    policy_handle_t *h = malloc(sizeof(policy_handle_t));
    h->db = db;
    return h;
}

EMSCRIPTEN_KEEPALIVE
void api_free_policy(policy_handle_t *h) {
    if (!h) return;
    sepol_policydb_free(h->db);
    free(h);
}

EMSCRIPTEN_KEEPALIVE
int api_get_version(policy_handle_t *h) {
    return ((struct sepol_policydb *)(h->db))->p.policyvers;
}

EMSCRIPTEN_KEEPALIVE
int api_get_symbol_count(policy_handle_t *h, int sym_type) {
    if (sym_type < 0 || sym_type >= SYM_NUM) return -1;
    return ((struct sepol_policydb *)(h->db))->p.symtab[sym_type].nprim;
}

EMSCRIPTEN_KEEPALIVE
const char* api_get_symbol_name(policy_handle_t *h, int sym_type, int value) {
    policydb_t *db = &((struct sepol_policydb *)(h->db))->p;
    if (sym_type < 0 || sym_type >= SYM_NUM) return NULL;
    if (value <= 0 || (uint32_t)value > db->symtab[sym_type].nprim) return NULL;
    return db->sym_val_to_name[sym_type][value - 1];
}

EMSCRIPTEN_KEEPALIVE
int api_is_type_attribute(policy_handle_t *h, int type_val) {
    policydb_t *db = &((struct sepol_policydb *)(h->db))->p;
    if (type_val <= 0 || (uint32_t)type_val > db->p_types.nprim) return -1;
    type_datum_t *t = db->type_val_to_struct[type_val - 1];
    if (!t) return -1;
    return (t->flavor == TYPE_ATTRIB) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int api_get_boolean_state(policy_handle_t *h, int bool_val) {
    policydb_t *db = &((struct sepol_policydb *)(h->db))->p;
    if (bool_val <= 0 || (uint32_t)bool_val > db->p_bools.nprim) return -1;
    cond_bool_datum_t *b = db->bool_val_to_struct[bool_val - 1];
    if (!b) return -1;
    return b->state;
}

struct rule_count_state {
    uint16_t mask;
    int count;
};

static int count_rules_by_mask(avtab_key_t *k, avtab_datum_t *d, void *ptr) {
    struct rule_count_state *state = (struct rule_count_state *)ptr;
    if (k->specified & state->mask) {
        state->count++;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int api_get_rule_count(policy_handle_t *h, uint16_t specified_mask) {
    policydb_t *db = &((struct sepol_policydb *)(h->db))->p;
    struct rule_count_state state = { specified_mask, 0 };
    avtab_map(&db->te_avtab, count_rules_by_mask, &state);
    return state.count;
}

typedef struct {
    uint32_t src;
    uint32_t tgt;
    uint32_t cls; // contains class ID in low 16 bits and specified mask in high 16 bits
    uint32_t data;
} rule_info_t;

struct rule_collect_state {
    policy_handle_t *handle;
    rule_info_t *rules;
    int index;
    int max;
    const char *query;
    int is_regex;
    regex_t *regex_compiled;
    uint16_t specified_mask;
};

static int collect_rules(avtab_key_t *k, avtab_datum_t *d, void *ptr) {
    struct rule_collect_state *state = (struct rule_collect_state *)ptr;
    if (!(k->specified & state->specified_mask)) return 0;
    if (state->index >= state->max) return 0;

    if (state->query && strlen(state->query) > 0) {
        const char *src_name = api_get_symbol_name(state->handle, SYM_TYPES, k->source_type);
        const char *tgt_name = api_get_symbol_name(state->handle, SYM_TYPES, k->target_type);
        const char *cls_name = api_get_symbol_name(state->handle, SYM_CLASSES, k->target_class);
        int match = 0;
        if (state->is_regex && state->regex_compiled) {
            if (src_name && regexec(state->regex_compiled, src_name, 0, NULL, 0) == 0) match = 1;
            if (!match && tgt_name && regexec(state->regex_compiled, tgt_name, 0, NULL, 0) == 0) match = 1;
            if (!match && cls_name && regexec(state->regex_compiled, cls_name, 0, NULL, 0) == 0) match = 1;
        } else {
            if (src_name && strstr(src_name, state->query)) match = 1;
            if (!match && tgt_name && strstr(tgt_name, state->query)) match = 1;
            if (!match && cls_name && strstr(cls_name, state->query)) match = 1;
        }
        if (!match) return 0;
    }

    state->rules[state->index].src = k->source_type;
    state->rules[state->index].tgt = k->target_type;
    state->rules[state->index].cls = k->target_class | (k->specified << 16);
    state->rules[state->index].data = d->data;
    state->index++;
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int api_get_rules(policy_handle_t *h, rule_info_t *out_rules, int max_rules, const char *query, int is_regex, uint16_t specified_mask) {
    policydb_t *db = &((struct sepol_policydb *)(h->db))->p;
    regex_t regex;
    regex_t *regex_ptr = NULL;
    if (is_regex && query && strlen(query) > 0) {
        if (regcomp(&regex, query, REG_EXTENDED | REG_ICASE | REG_NOSUB) == 0) {
            regex_ptr = &regex;
        } else {
            is_regex = 0;
        }
    }
    struct rule_collect_state state = { h, out_rules, 0, max_rules, query, is_regex, regex_ptr, specified_mask };
    avtab_map(&db->te_avtab, collect_rules, &state);
    if (regex_ptr) regfree(regex_ptr);
    return state.index;
}

EMSCRIPTEN_KEEPALIVE
char* api_get_permissions(policy_handle_t *h, int class_val, uint32_t data) {
    policydb_t *db = &((struct sepol_policydb *)(h->db))->p;
    if (class_val <= 0 || (uint32_t)class_val > db->p_classes.nprim) return NULL;
    return sepol_av_to_string(db, class_val, data);
}

EMSCRIPTEN_KEEPALIVE
void api_free_string(char *s) {
    if (s) free(s);
}

EMSCRIPTEN_KEEPALIVE
int api_get_type_attributes(policy_handle_t *h, int type_val, uint32_t *out_attrs, int max_attrs) {
    policydb_t *db = &((struct sepol_policydb *)(h->db))->p;
    if (type_val <= 0 || (uint32_t)type_val > db->p_types.nprim) return 0;
    int count = 0;
    ebitmap_node_t *node;
    unsigned int i;
    ebitmap_t *attr_map = &db->type_attr_map[type_val - 1];
    ebitmap_for_each_bit(attr_map, node, i) {
        if (ebitmap_get_bit(attr_map, i)) {
            if (db->type_val_to_struct[i]->flavor == TYPE_ATTRIB) {
                if (count < max_attrs) {
                    out_attrs[count++] = i + 1;
                }
            }
        }
    }
    return count;
}

struct type_rule_collect_state {
    policy_handle_t *handle;
    rule_info_t *rules;
    int index;
    int max;
    uint32_t target_type;
    int transitive;
    uint16_t specified_mask;
    ebitmap_t attributes;
};

static int collect_rules_for_type(avtab_key_t *k, avtab_datum_t *d, void *ptr) {
    struct type_rule_collect_state *state = (struct type_rule_collect_state *)ptr;
    if (!(k->specified & state->specified_mask)) return 0;
    if (state->index >= state->max) return 0;
    int match = 0;
    if (k->source_type == state->target_type || k->target_type == state->target_type) {
        match = 1;
    } else if (state->transitive) {
        if (ebitmap_get_bit(&state->attributes, k->source_type - 1) ||
            ebitmap_get_bit(&state->attributes, k->target_type - 1)) {
            match = 1;
        }
    }
    if (!match) return 0;
    state->rules[state->index].src = k->source_type;
    state->rules[state->index].tgt = k->target_type;
    state->rules[state->index].cls = k->target_class | (k->specified << 16);
    state->rules[state->index].data = d->data;
    state->index++;
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int api_get_rules_for_type(policy_handle_t *h, rule_info_t *out_rules, int max_rules, uint32_t type_val, int transitive, uint16_t specified_mask) {
    policydb_t *db = &((struct sepol_policydb *)(h->db))->p;
    struct type_rule_collect_state state = { h, out_rules, 0, max_rules, type_val, transitive, specified_mask };
    ebitmap_init(&state.attributes);
    if (transitive && type_val > 0 && type_val <= db->p_types.nprim) {
        ebitmap_cpy(&state.attributes, &db->type_attr_map[type_val - 1]);
    }
    avtab_map(&db->te_avtab, collect_rules_for_type, &state);
    ebitmap_destroy(&state.attributes);
    return state.index;
}
