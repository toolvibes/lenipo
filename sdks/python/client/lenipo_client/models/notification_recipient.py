from enum import StrEnum

class NotificationRecipient(StrEnum):
    ASSIGNEE = "assignee"
    GROUP = "group"
    REPORTER = "reporter"
    ROLE = "role"
    USER = "user"
    WATCHERS = "watchers"

    def __str__(self) -> str:
        return str(self.value)
