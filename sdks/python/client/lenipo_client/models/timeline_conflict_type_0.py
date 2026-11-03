from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="TimelineConflictType0")



@_attrs_define
class TimelineConflictType0:
    """ 
        Attributes:
            kind (Literal['dependency']):
            issue_key (str):
            blocker_key (str):
            days (int):
     """

    kind: Literal['dependency']
    issue_key: str
    blocker_key: str
    days: int





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        issue_key = self.issue_key

        blocker_key = self.blocker_key

        days = self.days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "issueKey": issue_key,
            "blockerKey": blocker_key,
            "days": days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal['dependency'] , d.pop("kind"))
        if kind != 'dependency':
            raise ValueError(f"kind must match const 'dependency', got '{kind}'")

        issue_key = d.pop("issueKey")

        blocker_key = d.pop("blockerKey")

        days = d.pop("days")

        timeline_conflict_type_0 = cls(
            kind=kind,
            issue_key=issue_key,
            blocker_key=blocker_key,
            days=days,
        )

        return timeline_conflict_type_0

