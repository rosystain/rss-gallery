"""add click_action to feeds

Revision ID: 3c4d5e6f7a8b
Revises: 7a8b9c0d1e2f
Create Date: 2026-05-15 08:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c4d5e6f7a8b'
down_revision: Union[str, Sequence[str], None] = '7a8b9c0d1e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add click_action column to feeds table."""
    op.add_column('feeds', sa.Column('click_action', sa.String(), nullable=True, server_default='modal'))


def downgrade() -> None:
    """Remove click_action column from feeds table."""
    op.drop_column('feeds', 'click_action')
