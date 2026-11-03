from enum import StrEnum

class NotificationRuleInputType0Recipient(StrEnum):
    ASSIGNEE = "assignee"
    REPORTER = "reporter"
    WATCHERS = "watchers"

    def __str__(self) -> str:
        return str(self.value)
