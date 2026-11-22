"""Private SQLite fixture bridge. Never connects to D1 or a network service."""
import sqlite3,json,sys
path,mode=sys.argv[1:3]
con=sqlite3.connect(path);con.row_factory=sqlite3.Row
if mode=='read':
 sql,args=json.loads(sys.argv[3])
 if not sql.lstrip().upper().startswith(('SELECT','EXPLAIN')):raise RuntimeError('API fixture rejects mutations')
 print(json.dumps([dict(x) for x in con.execute(sql,args)]))
elif mode=='fixture':
 sql,args=json.loads(sys.argv[3]);con.execute(sql,args);con.commit();print('{}')
elif mode=='seed':
 root,n=sys.argv[3],int(sys.argv[4])
 con.executescript("CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT); CREATE TABLE auth_sessions(user_id TEXT,session_hash TEXT,expires_at TEXT,revoked_at TEXT); CREATE TABLE profiles(id TEXT PRIMARY KEY); CREATE TABLE admin_users(user_id TEXT, role TEXT); CREATE TABLE sponsor_user_context(user_id TEXT PRIMARY KEY,sponsor_id TEXT);")
 for file in ['0027_intap_artifacts.sql','0062_sponsored_profiles_v1.sql','0063_sponsored_master_artifact.sql','0066_sponsored_owner_profile.sql']:
  con.executescript(open(root+'/api/migrations/'+file).read())
 a,b='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
 for tenant in [a,b]:con.execute("INSERT INTO sponsor_tenants(id,name,slug) VALUES(?,?,?)",[tenant,'Patrocinador '+tenant[0].upper(),'tenant-'+tenant[0]])
 import hashlib
 actors=[('normal','owner@example.test','owner'),('operator','intapcard@gmail.com','owner'),('admin','admin@example.test','admin'),('viewer','viewer@example.test','viewer'),('outsider','outside@example.test',None)]
 for uid,email,role in actors:
  con.execute('INSERT INTO users VALUES(?,?)',[uid,email]);con.execute("INSERT INTO auth_sessions VALUES(?,?,datetime('now','+1 day'),NULL)",[uid,hashlib.sha256(('fixture-'+uid).encode()).hexdigest()])
  if role:con.execute('INSERT INTO sponsor_members(sponsor_id,user_id,role) VALUES(?,?,?)',[a,uid,role])
 con.execute("INSERT INTO sponsor_members(sponsor_id,user_id,role) VALUES(?,?,'owner')",[b,'operator']);con.execute('INSERT INTO sponsor_user_context VALUES(?,?)',['operator',a])
 for tenant,count in [(a,n),(b,23)]:
  tag=tenant[0]
  con.execute('INSERT INTO sponsor_batches(id,sponsor_id,name,city,zone) VALUES(?,?,?,?,?)',['batch-'+tag,tenant,'Lote Caribe','Santo Domingo','Zona Norte'])
  con.execute('INSERT INTO users VALUES(?,?)',['beneficiary-'+tag,'cliente-'+tag+'@example.test'])
  for i in range(count+1):
   artifact=f'{tag}-artifact-{i:06d}';master=i==count
   con.execute("INSERT INTO intap_artifacts(id,public_code,product_type,status) VALUES(?,?,?,'available')",[artifact,'MASTER'+tag.upper() if master else f'{tag.upper()}CODE{i:06d}','keychain'])
   profile=f'{tag}-profile-{i:06d}'
   con.execute("INSERT INTO sponsored_profiles(id,sponsor_id,artifact_id,user_id,username,business_name,phone,whatsapp,status,profile_role) VALUES(?,?,?,?,?,?,?,?,?,?)",[profile,tenant,artifact,'beneficiary-'+tag,profile,'Master' if master else ('Clínica ÁRBOL %_ literal' if i==0 else 'Comercio '+str(i)),'8095550100','18095550100','published' if i%3==0 else 'draft','master' if master else 'beneficiary'])
   con.execute("INSERT INTO sponsor_artifacts(sponsor_id,artifact_id,batch_id,sponsored_profile_id,beneficiary_user_id,status,artifact_role,created_at) VALUES(?,?,?,?,?,?,?,?)",[tenant,artifact,'batch-'+tag,profile,'beneficiary-'+tag,'activated' if i%2 else 'available','master' if master else 'beneficiary',f'2026-11-{1+i%20:02d} 10:00:00'])
 con.commit();print('{}')
else:raise RuntimeError('Unknown fixture operation')
