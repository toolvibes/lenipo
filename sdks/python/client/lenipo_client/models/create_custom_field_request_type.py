from enum import StrEnum

class CreateCustomFieldRequestType(StrEnum):
    CASCADE = "cascade"
    CHECKBOX = "checkbox"
    DATE = "date"
    DATETIME = "datetime"
    GROUP = "group"
    LABELS = "labels"
    MULTISELECT = "multiselect"
    NUMBER = "number"
    SELECT = "select"
    TEXT = "text"
    TEXTAREA = "textarea"
    URL = "url"
    USER = "user"
    USERS = "users"
    VERSION = "version"

    def __str__(self) -> str:
        return str(self.value)
