from pathlib import Path

import psycopg

from app.config import get_settings

SCHEMA = Path(__file__).with_name("schema.sql")


def connect() -> psycopg.Connection:
    return psycopg.connect(get_settings().database_url)


def init_schema(conn: psycopg.Connection) -> None:
    conn.execute(SCHEMA.read_text())
    conn.commit()
