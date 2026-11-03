from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="WikiSettingsInput")



@_attrs_define
class WikiSettingsInput:
    """ 
        Attributes:
            outdated_after_days (int | None):
     """

    outdated_after_days: int | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        outdated_after_days: int | None
        outdated_after_days = self.outdated_after_days


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "outdatedAfterDays": outdated_after_days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_outdated_after_days(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        outdated_after_days = _parse_outdated_after_days(d.pop("outdatedAfterDays"))


        wiki_settings_input = cls(
            outdated_after_days=outdated_after_days,
        )


        wiki_settings_input.additional_properties = d
        return wiki_settings_input

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
