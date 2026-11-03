from enum import StrEnum

class TimelineEpicProgressUnit(StrEnum):
    ISSUES = "issues"
    POINTS = "points"

    def __str__(self) -> str:
        return str(self.value)
