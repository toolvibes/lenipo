from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="FeatureFlagsInput")



@_attrs_define
class FeatureFlagsInput:
    """ 
        Attributes:
            wiki (bool | Unset):  Default: True.
            boards (bool | Unset):  Default: True.
            time_tracking (bool | Unset):  Default: True.
            automation (bool | Unset):  Default: True.
            dashboards (bool | Unset):  Default: True.
     """

    wiki: bool | Unset = True
    boards: bool | Unset = True
    time_tracking: bool | Unset = True
    automation: bool | Unset = True
    dashboards: bool | Unset = True
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        wiki = self.wiki

        boards = self.boards

        time_tracking = self.time_tracking

        automation = self.automation

        dashboards = self.dashboards


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if wiki is not UNSET:
            field_dict["wiki"] = wiki
        if boards is not UNSET:
            field_dict["boards"] = boards
        if time_tracking is not UNSET:
            field_dict["time-tracking"] = time_tracking
        if automation is not UNSET:
            field_dict["automation"] = automation
        if dashboards is not UNSET:
            field_dict["dashboards"] = dashboards

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        wiki = d.pop("wiki", UNSET)

        boards = d.pop("boards", UNSET)

        time_tracking = d.pop("time-tracking", UNSET)

        automation = d.pop("automation", UNSET)

        dashboards = d.pop("dashboards", UNSET)

        feature_flags_input = cls(
            wiki=wiki,
            boards=boards,
            time_tracking=time_tracking,
            automation=automation,
            dashboards=dashboards,
        )


        feature_flags_input.additional_properties = d
        return feature_flags_input

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
