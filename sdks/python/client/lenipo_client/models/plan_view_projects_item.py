from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.timeline_epic import TimelineEpic





T = TypeVar("T", bound="PlanViewProjectsItem")



@_attrs_define
class PlanViewProjectsItem:
    """ 
        Attributes:
            key (str):
            name (str):
            epics (list[TimelineEpic]):
     """

    key: str
    name: str
    epics: list[TimelineEpic]





    def to_dict(self) -> dict[str, Any]:
        from ..models.timeline_epic import TimelineEpic # noqa: PLC0415
        key = self.key

        name = self.name

        epics = []
        for epics_item_data in self.epics:
            epics_item = epics_item_data.to_dict()
            epics.append(epics_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "name": name,
            "epics": epics,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.timeline_epic import TimelineEpic # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        name = d.pop("name")

        epics = []
        _epics = d.pop("epics")
        for epics_item_data in (_epics):
            epics_item = TimelineEpic.from_dict(epics_item_data)



            epics.append(epics_item)


        plan_view_projects_item = cls(
            key=key,
            name=name,
            epics=epics,
        )

        return plan_view_projects_item

