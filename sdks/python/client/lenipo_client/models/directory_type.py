from enum import StrEnum

class DirectoryType(StrEnum):
    INTERNAL = "internal"
    LDAP = "ldap"

    def __str__(self) -> str:
        return str(self.value)
