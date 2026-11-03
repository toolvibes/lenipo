from enum import StrEnum

class SubscriptionSchedule(StrEnum):
    DAILY = "daily"
    WEEKDAYS = "weekdays"
    WEEKLY = "weekly"

    def __str__(self) -> str:
        return str(self.value)
