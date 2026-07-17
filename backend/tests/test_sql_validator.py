import pytest
from sql_validator import validate_query_for_dialect, validate_readonly_sql


def test_readonly_blocks_create():
    with pytest.raises(ValueError, match="Read-only violation"):
        validate_readonly_sql("CREATE TABLE sales (id int)")


def test_approval_path_allows_create():
    validate_query_for_dialect(
        "CREATE TABLE sales (id int)",
        "postgresql",
        allow_mutating=True,
    )
