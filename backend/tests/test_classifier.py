from adapters.classifier import OperationClassifier
from adapters.base import OperationKind


def test_sql_classification():
    assert OperationClassifier.classify("select * from users", "postgresql").operation == OperationKind.READ
    assert OperationClassifier.classify("update users set name='x'", "postgresql").operation == OperationKind.WRITE
    assert OperationClassifier.classify("create table x(id int)", "postgresql").operation == OperationKind.SCHEMA


def test_mongo_classification():
    q = '{"collection":"users","action":"find","query":{}}'
    assert OperationClassifier.classify(q, "mongodb").operation == OperationKind.READ
    q2 = '{"collection":"users","action":"updateOne","query":{"id":1}}'
    assert OperationClassifier.classify(q2, "mongodb").operation == OperationKind.WRITE
