from pathlib import Path
import secrets
target=Path(__file__).resolve().parent/'.env'
if target.exists():
    print('Existing .env retained. Administrator credential is in that file.')
else:
    target.write_text('ADMIN_TOKEN='+secrets.token_urlsafe(32)+'\nPOSTGRES_PASSWORD='+secrets.token_urlsafe(32)+'\nOFFLINE_THRESHOLD_SECONDS=180\n',encoding='utf8')
    print('Created',target,'Keep this file private. Use ADMIN_TOKEN to sign into the dashboard.')
