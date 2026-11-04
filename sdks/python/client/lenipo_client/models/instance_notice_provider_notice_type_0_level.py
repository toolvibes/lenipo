from enum import StrEnum

class InstanceNoticeProviderNoticeType0Level(StrEnum):
    INFO = "info"
    WARNING = "warning"

    def __str__(self) -> str:
        return str(self.value)
