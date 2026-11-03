from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.timeline_epic_progress_unit import TimelineEpicProgressUnit






T = TypeVar("T", bound="TimelineEpicProgress")



@_attrs_define
class TimelineEpicProgress:
    """ 
        Attributes:
            done (float):
            total (float):
            unit (TimelineEpicProgressUnit):
     """

    done: float
    total: float
    unit: TimelineEpicProgressUnit





    def to_dict(self) -> dict[str, Any]:
        done = self.done

        total = self.total

        unit = self.unit.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "done": done,
            "total": total,
            "unit": unit,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        done = d.pop("done")

        total = d.pop("total")

        unit = TimelineEpicProgressUnit(d.pop("unit"))




        timeline_epic_progress = cls(
            done=done,
            total=total,
            unit=unit,
        )

        return timeline_epic_progress

