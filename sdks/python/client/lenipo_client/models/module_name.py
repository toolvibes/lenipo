from enum import StrEnum

class ModuleName(StrEnum):
    AUTOMATION = "automation"
    BOARDS = "boards"
    DASHBOARDS = "dashboards"
    TIME_TRACKING = "time-tracking"
    WIKI = "wiki"

    def __str__(self) -> str:
        return str(self.value)
