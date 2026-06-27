"""add fixed_costs table

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-06-26 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'fixed_costs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('label', sa.String(length=120), nullable=False),
        sa.Column('match_key', sa.String(length=120), nullable=False),
        sa.Column('person', sa.String(length=20), nullable=True),
        sa.Column('expected_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('fixed_costs')
