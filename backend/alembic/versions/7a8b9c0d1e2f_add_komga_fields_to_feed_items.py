"""add komga fields to feed items

Revision ID: 7a8b9c0d1e2f
Revises: 455744e62a02
Create Date: 2026-01-01 05:12:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, Sequence[str], None] = '455744e62a02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add komga_status and komga_sync_at columns to feed_items table."""
    # Add komga_status column (0: unchecked, 1: in library, 2: not in library)
    op.add_column('feed_items', sa.Column('komga_status', sa.Integer(), nullable=False, server_default='0'))
    
    # Add komga_sync_at column (timestamp of last API call)
    op.add_column('feed_items', sa.Column('komga_sync_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Remove komga_status and komga_sync_at columns from feed_items table."""
    op.drop_column('feed_items', 'komga_sync_at')
    op.drop_column('feed_items', 'komga_status')
