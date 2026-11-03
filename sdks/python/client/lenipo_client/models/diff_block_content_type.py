from enum import StrEnum

class DiffBlockContentType(StrEnum):
    CODEBLOCK = "codeBlock"
    HEADING = "heading"
    IMAGE = "image"
    LISTITEM = "listItem"
    PARAGRAPH = "paragraph"
    QUOTE = "quote"
    RULE = "rule"
    TABLEROW = "tableRow"
    TASKITEM = "taskItem"

    def __str__(self) -> str:
        return str(self.value)
