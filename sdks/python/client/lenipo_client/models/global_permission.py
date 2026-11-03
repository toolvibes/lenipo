from enum import StrEnum

class GlobalPermission(StrEnum):
    ADMIN = "admin"
    BROWSE_USERS = "browse-users"
    BULK_CHANGE = "bulk-change"
    CREATE_PROJECTS = "create-projects"
    CREATE_SPACES = "create-spaces"
    SHARE_FILTERS = "share-filters"
    SYSTEM_ADMIN = "system-admin"

    def __str__(self) -> str:
        return str(self.value)
