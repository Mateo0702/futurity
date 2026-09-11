from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings
args = {'pool_pre_ping': True}
if settings.DATABASE_URL.startswith('sqlite'):
    args['connect_args'] = {'check_same_thread': False, 'timeout': 30}
engine = create_engine(settings.DATABASE_URL, **args)
if engine.dialect.name == 'sqlite':
    @event.listens_for(engine, 'connect')
    def configure_sqlite(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA journal_mode=WAL')
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()
def get_db():
    with SessionLocal() as db:
        yield db
