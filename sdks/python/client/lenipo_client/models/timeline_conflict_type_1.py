from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="TimelineConflictType1")



@_attrs_define
class TimelineConflictType1:
    """ 
        Attributes:
            kind (Literal['milestone']):
            issue_key (str):
            version (str):
            days (int):
     """

    kind: Literal['milestone']
    issue_key: str
    version: str
    days: int





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        issue_key = self.issue_key

        version = self.version

        days = self.days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "issueKey": issue_key,
            "version": version,
            "days": days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal['milestone'] , d.pop("kind"))
        if kind != 'milestone':
            raise ValueError(f"kind must match const 'milestone', got '{kind}'")

        issue_key = d.pop("issueKey")

        version = d.pop("version")

        days = d.pop("days")

        timeline_conflict_type_1 = cls(
            kind=kind,
            issue_key=issue_key,
            version=version,
            days=days,
        )

        return timeline_conflict_type_1

