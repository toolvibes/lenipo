from enum import StrEnum

class ImportJobState(StrEnum):
    DONE = "done"
    FAILED = "failed"
    PENDING = "pending"
    RUNNING = "running"

    def __str__(self) -> str:
        return str(self.value)
