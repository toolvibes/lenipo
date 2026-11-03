from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="TimelineDependency")



@_attrs_define
class TimelineDependency:
    """ 
        Attributes:
            link_id (UUID):
            from_ (str):
            to (str):
            conflict (bool):
     """

    link_id: UUID
    from_: str
    to: str
    conflict: bool





    def to_dict(self) -> dict[str, Any]:
        link_id = str(self.link_id)

        from_ = self.from_

        to = self.to

        conflict = self.conflict


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "linkId": link_id,
            "from": from_,
            "to": to,
            "conflict": conflict,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        link_id = UUID(d.pop("linkId"))




        from_ = d.pop("from")

        to = d.pop("to")

        conflict = d.pop("conflict")

        timeline_dependency = cls(
            link_id=link_id,
            from_=from_,
            to=to,
            conflict=conflict,
        )

        return timeline_dependency

