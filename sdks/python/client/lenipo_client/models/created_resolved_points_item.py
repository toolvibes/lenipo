from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="CreatedResolvedPointsItem")



@_attrs_define
class CreatedResolvedPointsItem:
    """ 
        Attributes:
            date (datetime.date):
            created (int):
            resolved (int):
     """

    date: datetime.date
    created: int
    resolved: int





    def to_dict(self) -> dict[str, Any]:
        date = self.date.isoformat()

        created = self.created

        resolved = self.resolved


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "date": date,
            "created": created,
            "resolved": resolved,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        date = datetime.date.fromisoformat(d.pop("date"))




        created = d.pop("created")

        resolved = d.pop("resolved")

        created_resolved_points_item = cls(
            date=date,
            created=created,
            resolved=resolved,
        )

        return created_resolved_points_item

