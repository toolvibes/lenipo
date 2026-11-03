from enum import StrEnum

class IssueExportRequestColumnsItemType0(StrEnum):
    ASSIGNEE = "assignee"
    COMPONENT = "component"
    CREATED = "created"
    DUE = "due"
    FIXVERSION = "fixVersion"
    ISSUETYPE = "issuetype"
    LABELS = "labels"
    ORIGINALESTIMATE = "originalEstimate"
    PRIORITY = "priority"
    REMAININGESTIMATE = "remainingEstimate"
    REPORTER = "reporter"
    RESOLUTION = "resolution"
    STATUS = "status"
    STORYPOINTS = "storyPoints"
    TIMESPENT = "timeSpent"
    UPDATED = "updated"

    def __str__(self) -> str:
        return str(self.value)
