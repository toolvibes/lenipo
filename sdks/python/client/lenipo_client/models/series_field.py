from enum import StrEnum

class SeriesField(StrEnum):
    ASSIGNEE = "assignee"
    ISSUETYPE = "issueType"
    PRIORITY = "priority"
    STATUS = "status"
    STATUSCATEGORY = "statusCategory"

    def __str__(self) -> str:
        return str(self.value)
