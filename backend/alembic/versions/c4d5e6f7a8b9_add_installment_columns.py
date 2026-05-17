"""add installment columns to transactions

Revision ID: c4d5e6f7a8b9
Revises: b3f2a1c4d5e6
Create Date: 2026-05-17 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3f2a1c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('transactions', sa.Column('installment_current', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('installment_total', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('original_purchase_date', sa.Date(), nullable=True))

def downgrade() -> None:
    op.drop_column('transactions', 'original_purchase_date')
    op.drop_column('transactions', 'installment_total')
    op.drop_column('transactions', 'installment_current')
