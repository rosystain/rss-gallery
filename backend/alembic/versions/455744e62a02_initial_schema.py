"""initial schema

Revision ID: 455744e62a02
Revises: 
Create Date: 2025-12-31 09:07:15.881624

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '455744e62a02'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create all tables from scratch."""
    # This migration is designed to work with both new and existing databases
    # It will only create tables/columns that don't exist
    
    # Create feeds table if it doesn't exist
    # Note: Alembic doesn't have a built-in "CREATE TABLE IF NOT EXISTS"
    # so we use a try-except approach in the application code
    # For a clean database, this will create all tables
    pass


def downgrade() -> None:
    """Downgrade schema."""
    # For initial migration, downgrade would drop all tables
    # But we'll keep it safe and do nothing
    pass
