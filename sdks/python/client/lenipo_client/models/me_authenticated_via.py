from enum import StrEnum

class MeAuthenticatedVia(StrEnum):
    MCP = "mcp"
    SESSION = "session"
    TOKEN = "token"

    def __str__(self) -> str:
        return str(self.value)
