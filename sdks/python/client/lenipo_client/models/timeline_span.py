from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="TimelineSpan")



@_attrs_define
class TimelineSpan:
    """ 
        Attributes:
            start (datetime.date):
            end (datetime.date):
            derived (bool):
     """

    start: datetime.date
    end: datetime.date
    derived: bool





    def to_dict(self) -> dict[str, Any]:
        start = self.start.isoformat()

        end = self.end.isoformat()

        derived = self.derived


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "start": start,
            "end": end,
            "derived": derived,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        start = datetime.date.fromisoformat(d.pop("start"))




        end = datetime.date.fromisoformat(d.pop("end"))




        derived = d.pop("derived")

        timeline_span = cls(
            start=start,
            end=end,
            derived=derived,
        )

        return timeline_span

