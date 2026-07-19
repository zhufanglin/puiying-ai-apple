import os; os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///./test.db'
import app.core.config; app.core.config.get_settings.cache_clear()
from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)
r = client.post('/api/v1/auth/login', json={'username':'admin','password':'admin123'})
token = r.json()['data']['access_token']
headers = {'Authorization': f'Bearer {token}'}

results = []

def check(label, condition, detail=''):
    status = 'PASS' if condition else 'FAIL'
    results.append((status, label, detail))
    print(f'  [{status}] {label}')
    if detail and not condition:
        print(f'         {detail}')

print('=== A1 奖状奖学金 ===')
r = client.get('/api/v1/apple/awards/templates', headers=headers)
templates = r.json()['data']
check('奖状模板 CRUD - 列表返回', r.status_code == 200 and len(templates) > 0)

r = client.get('/api/v1/apple/awards/', headers=headers)
awards = r.json()['data']['items']
check('奖状创建/列表 - 列表返回', r.status_code == 200 and len(awards) > 0)

check('奖状含 recipients', all(len(a.get('recipients',[])) > 0 for a in awards if 'recipients' in a))

r = client.get('/api/v1/apple/awards/1', headers=headers)
check('奖状详情', r.status_code == 200 and r.json()['data']['id'] == 1)

award_statuses = [a['status'] for a in awards]
check('奖状状态流转（published 存在）', 'published' in award_statuses or 'confirmed' in award_statuses)

check('证书编号存在', any(a.get('recipients') and all(r.get('certificate_no') for r in a['recipients']) for a in awards))

# Create a scholarship
r = client.post('/api/v1/apple/awards/scholarships', json={'student_name':'Test','student_class':'5A','amount':1000,'school_year':'2025','term':'1'}, headers=headers)
check('奖学金申请提交', r.status_code == 200)

r = client.get('/api/v1/apple/awards/scholarships', headers=headers)
check('奖学金申请列表', r.status_code == 200)

r = client.get('/api/v1/apple/awards/statistics', headers=headers)
check('奖状/奖学金统计', r.status_code == 200)

print()
print('=== A2 财务收支 ===')
r = client.get('/api/v1/apple/finance/income', headers=headers)
check('收入列表', r.status_code == 200 and len(r.json()['data']['items']) > 0)

r = client.get('/api/v1/apple/finance/expense', headers=headers)
check('支出列表', r.status_code == 200 and len(r.json()['data']['items']) > 0)

r = client.get('/api/v1/apple/finance/quotations', headers=headers)
check('报价单列表', r.status_code == 200 and len(r.json()['data']['items']) > 0)

# Test quotation analysis
r = client.get('/api/v1/apple/finance/quotations', headers=headers)
quotes = r.json()['data']['items']
has_lowest = any(q.get('is_lowest') for q in quotes)
has_selected = any(q.get('is_selected') for q in quotes)
check('报价单选中/未选中状态', has_lowest or has_selected)

print()
print('=== A3 资产盘点 ===')
r = client.get('/api/v1/apple/assets/', headers=headers)
check('资产列表', r.status_code == 200)
assets = r.json()['data']['items'] if isinstance(r.json()['data'], dict) else r.json()['data']
check('多项资产', len(assets) > 0)

statuses = [a['status'] for a in assets]
check('资产状态区分', 'active' in statuses and 'written_off' in statuses)

r = client.get('/api/v1/apple/assets/1', headers=headers)
check('资产详情', r.status_code == 200)

# Check asset movements
r = client.get('/api/v1/apple/assets/1/movements', headers=headers)
check('资产移动记录', r.status_code == 200)

print()
print('=== A4 学生事务 ===')
r = client.get('/api/v1/apple/students/', headers=headers)
check('学生列表', r.status_code == 200 and len(r.json()['data']) > 0)

r = client.get('/api/v1/apple/students/summary', headers=headers)
check('学生统计数据', r.status_code == 200)

r = client.get('/api/v1/apple/students/1', headers=headers)
check('学生详情', r.status_code == 200)

r = client.get('/api/v1/apple/students/work-items', params={'page':1,'pageSize':20}, headers=headers)
check('学生待办事项', r.status_code == 200)

# Test student photo upload is supported (endpoint exists)
r = client.get('/api/v1/apple/students/photos', headers=headers)
check('学生照片上传端点存在', r.status_code != 404)

print()
total = len(results)
passed = sum(1 for s,_,_ in results if s == 'PASS')
print(f'=== 总计: {passed}/{total} 通过 ===')
