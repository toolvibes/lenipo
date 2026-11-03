from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.backup_state import BackupState
from ..models.backup_trigger import BackupTrigger
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="Backup")



@_attrs_define
class Backup:
    """ 
        Attributes:
            id (UUID):
            trigger (BackupTrigger):
            state (BackupState):
            created_at (str):
            finished_at (None | str):
            size_bytes (int | None):
            rows (int | None):
            files (int | None):
            error (None | str):
     """

    id: UUID
    trigger: BackupTrigger
    state: BackupState
    created_at: str
    finished_at: None | str
    size_bytes: int | None
    rows: int | None
    files: int | None
    error: None | str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        trigger = self.trigger.value

        state = self.state.value

        created_at = self.created_at

        finished_at: None | str
        finished_at = self.finished_at

        size_bytes: int | None
        size_bytes = self.size_bytes

        rows: int | None
        rows = self.rows

        files: int | None
        files = self.files

        error: None | str
        error = self.error


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "trigger": trigger,
            "state": state,
            "createdAt": created_at,
            "finishedAt": finished_at,
            "sizeBytes": size_bytes,
            "rows": rows,
            "files": files,
            "error": error,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        trigger = BackupTrigger(d.pop("trigger"))




        state = BackupState(d.pop("state"))




        created_at = d.pop("createdAt")

        def _parse_finished_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        finished_at = _parse_finished_at(d.pop("finishedAt"))


        def _parse_size_bytes(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        size_bytes = _parse_size_bytes(d.pop("sizeBytes"))


        def _parse_rows(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        rows = _parse_rows(d.pop("rows"))


        def _parse_files(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        files = _parse_files(d.pop("files"))


        def _parse_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error = _parse_error(d.pop("error"))


        backup = cls(
            id=id,
            trigger=trigger,
            state=state,
            created_at=created_at,
            finished_at=finished_at,
            size_bytes=size_bytes,
            rows=rows,
            files=files,
            error=error,
        )

        return backup

