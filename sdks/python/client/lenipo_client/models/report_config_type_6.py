from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="ReportConfigType6")



@_attrs_define
class ReportConfigType6:
    """ 
        Attributes:
            kind (Literal['scope-progress']):
            query (str):
            board_id (UUID):
     """

    kind: Literal['scope-progress']
    query: str
    board_id: UUID





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        query = self.query

        board_id = str(self.board_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "query": query,
            "boardId": board_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal['scope-progress'] , d.pop("kind"))
        if kind != 'scope-progress':
            raise ValueError(f"kind must match const 'scope-progress', got '{kind}'")

        query = d.pop("query")

        board_id = UUID(d.pop("boardId"))




        report_config_type_6 = cls(
            kind=kind,
            query=query,
            board_id=board_id,
        )

        return report_config_type_6

