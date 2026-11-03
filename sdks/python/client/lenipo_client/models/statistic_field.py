from enum import StrEnum

class StatisticField(StrEnum):
    ASSIGNEE = "assignee"
    COMPONENT = "component"
    ISSUETYPE = "issueType"
    LABEL = "label"
    PRIORITY = "priority"
    PROJECT = "project"
    REPORTER = "reporter"
    RESOLUTION = "resolution"
    STATUS = "status"
    STATUSCATEGORY = "statusCategory"

    def __str__(self) -> str:
        return str(self.value)
