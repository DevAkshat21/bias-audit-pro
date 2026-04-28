import requests
import pandas as pd
import numpy as np
import io
import json

BASE_URL = "http://localhost:8000"

def upload_csv(df, name="test.csv"):
    buffer = io.BytesIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    files = {'file': (name, buffer, 'text/csv')}
    response = requests.post(f"{BASE_URL}/upload-headers", files=files)
    return response.json(), response.status_code

def analyze(session_id, target, protected):
    data = {
        'sessionId': session_id,
        'target': target,
        'protectedAttributes': json.dumps(protected)
    }
    response = requests.post(f"{BASE_URL}/analyze", data=data)
    return response.json(), response.status_code

print("=== 1. Normal Dataset Test ===")
df_normal = pd.DataFrame({
    'age': np.random.randint(20, 60, 100),
    'income': np.random.choice(['>50K', '<=50K'], 100),
    'sex': np.random.choice(['Male', 'Female'], 100)
})
upload_res, _ = upload_csv(df_normal)
sess_id = upload_res['sessionId']
res, status = analyze(sess_id, 'income', ['sex'])
if status != 200:
    print(res)
    if 'traceback' in res:
        print(res['traceback'])
assert status == 200
assert 'explainability' in res
assert res['explainability']['status'] == 'computed'
print("Normal test passed.")

print("=== 2. Weird Dataset Test (IDs, constants) ===")
df_weird = pd.DataFrame({
    'id': range(100),
    'constant_col': [42]*100,
    'income': np.random.choice(['>50K', '<=50K'], 100),
    'sex': np.random.choice(['Male', 'Female'], 100)
})
upload_res, _ = upload_csv(df_weird)
sess_id = upload_res['sessionId']
res, status = analyze(sess_id, 'income', ['sex'])
assert status == 200
print("Weird dataset handled successfully.")

print("=== 3. Invalid Config Test ===")
res, status = analyze(sess_id, 'missing_target', ['sex'])
assert status == 400
assert res['error'] == 'Analysis failed'
print("Invalid config rejected successfully.")

print("=== 4. Mixed-type column test ===")
df_mixed = pd.DataFrame({
    'age': [25, 'unknown', 30, 'thirty', 40] * 20,
    'income': np.random.choice(['A', 'B'], 100),
    'race': np.random.choice(['W', 'B'], 100)
})
upload_res, _ = upload_csv(df_mixed)
sess_id = upload_res['sessionId']
res, status = analyze(sess_id, 'income', ['race'])
assert status == 200
print("Mixed-type column handled successfully.")

print("ALL TESTS PASSED")
