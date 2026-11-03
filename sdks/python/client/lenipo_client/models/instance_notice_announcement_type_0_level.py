from enum import StrEnum

class InstanceNoticeAnnouncementType0Level(StrEnum):
    INFO = "info"
    WARNING = "warning"

    def __str__(self) -> str:
        return str(self.value)
