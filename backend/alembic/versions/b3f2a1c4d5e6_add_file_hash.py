"""add file_hash to uploaded_files

Revision ID: b3f2a1c4d5e6
Revises: ea20c9e60b83
Create Date: 2026-05-16 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b3f2a1c4d5e6'
down_revision: Union[str, None] = 'ea20c9e60b83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('uploaded_files', sa.Column('file_hash', sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column('uploaded_files', 'file_hash')
