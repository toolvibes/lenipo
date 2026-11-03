from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="ApplyScenarioRequest")



@_attrs_define
class ApplyScenarioRequest:
    """ 
        Attributes:
            issue_keys (list[str] | Unset):
     """

    issue_keys: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        issue_keys: list[str] | Unset = UNSET
        if not isinstance(self.issue_keys, Unset):
            issue_keys = self.issue_keys




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if issue_keys is not UNSET:
            field_dict["issueKeys"] = issue_keys

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        issue_keys = cast(list[str], d.pop("issueKeys", UNSET))


        apply_scenario_request = cls(
            issue_keys=issue_keys,
        )


        apply_scenario_request.additional_properties = d
        return apply_scenario_request

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
