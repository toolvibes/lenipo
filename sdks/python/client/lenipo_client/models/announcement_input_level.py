from enum import StrEnum

class AnnouncementInputLevel(StrEnum):
    INFO = "info"
    WARNING = "warning"

    def __str__(self) -> str:
        return str(self.value)
