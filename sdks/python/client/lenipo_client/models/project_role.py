from enum import StrEnum

class ProjectRole(StrEnum):
    ADMINISTRATORS = "administrators"
    DEVELOPERS = "developers"
    USERS = "users"

    def __str__(self) -> str:
        return str(self.value)
