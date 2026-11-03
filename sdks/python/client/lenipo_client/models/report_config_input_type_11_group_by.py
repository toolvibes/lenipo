from enum import StrEnum

class ReportConfigInputType11GroupBy(StrEnum):
    EPIC = "epic"
    ISSUE = "issue"
    PERSON = "person"
    PROJECT = "project"

    def __str__(self) -> str:
        return str(self.value)
