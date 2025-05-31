import test_pb2

person = test_pb2.Person()
person.name = "Jules"
person.id = 99
person.is_active = True

with open("person_data.bin", "wb") as f:
    f.write(person.SerializeToString())

print("person_data.bin created successfully.")
