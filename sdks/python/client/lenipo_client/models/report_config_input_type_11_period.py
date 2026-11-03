from enum import StrEnum

class ReportConfigInputType11Period(StrEnum):
    DAY = "day"
    MONTH = "month"
    NONE = "none"
    WEEK = "week"

    def __str__(self) -> str:
        return str(self.value)
