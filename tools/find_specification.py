import json
import os
from urllib.request import urlopen
import time

# with open(os.path.dirname(__file__) + '/../main/mime-db/iana-types.json') as f:
#     result = {}
#     iana = json.load(f)
#     for mime, data in iana.items():
#         for source in data['sources']:
#             if source.startswith('https://www.iana.org/assignments/media-types/'):
#                 result[source] = ''
#     with open('specifications.json', 'w') as output:
#         json.dump(result, output, indent=4)

with open('specifications.json') as spec:
    specification = json.load(spec)

for mime, spec in specification.items():
    if spec is None:
        time.sleep(10)
        with urlopen(mime) as response:
            print('fetched', mime)
            result = []
            capturing = False
            for line in response:
                if line.startswith(b'Published specification:'):
                    capturing = True
                if not line or line.isspace():
                    capturing = False
                if capturing:
                    result.append(line.decode('utf-8'))
            specification[mime] = ''.join(result)
            with open('specifications.new.json', 'w') as output:
                json.dump(specification, output, indent=4)
