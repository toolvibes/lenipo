from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="FeatureFlags")



@_attrs_define
class FeatureFlags:
    """ 
        Attributes:
            wiki (bool):  Default: True.
            boards (bool):  Default: True.
            time_tracking (bool):  Default: True.
            automation (bool):  Default: True.
            dashboards (bool):  Default: True.
     """

    wiki: bool = True
    boards: bool = True
    time_tracking: bool = True
    automation: bool = True
    dashboards: bool = True





    def to_dict(self) -> dict[str, Any]:
        wiki = self.wiki

        boards = self.boards

        time_tracking = self.time_tracking

        automation = self.automation

        dashboards = self.dashboards


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "wiki": wiki,
            "boards": boards,
            "time-tracking": time_tracking,
            "automation": automation,
            "dashboards": dashboards,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        wiki = d.pop("wiki")

        boards = d.pop("boards")

        time_tracking = d.pop("time-tracking")

        automation = d.pop("automation")

        dashboards = d.pop("dashboards")

        feature_flags = cls(
            wiki=wiki,
            boards=boards,
            time_tracking=time_tracking,
            automation=automation,
            dashboards=dashboards,
        )

        return feature_flags

