from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="ProjectFieldSetting")



@_attrs_define
class ProjectFieldSetting:
    """ 
        Attributes:
            required (bool | Unset):  Default: False.
            hidden (bool | Unset):  Default: False.
            description (None | str | Unset):
            issue_type_ids (list[UUID] | Unset):
            option_ids (list[UUID] | Unset):
            default_value (bool | float | list[str] | list[UUID] | None | str | Unset):
            tab (None | str | Unset):
     """

    required: bool | Unset = False
    hidden: bool | Unset = False
    description: None | str | Unset = UNSET
    issue_type_ids: list[UUID] | Unset = UNSET
    option_ids: list[UUID] | Unset = UNSET
    default_value: bool | float | list[str] | list[UUID] | None | str | Unset = UNSET
    tab: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        required = self.required

        hidden = self.hidden

        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        issue_type_ids: list[str] | Unset = UNSET
        if not isinstance(self.issue_type_ids, Unset):
            issue_type_ids = []
            for issue_type_ids_item_data in self.issue_type_ids:
                issue_type_ids_item = str(issue_type_ids_item_data)
                issue_type_ids.append(issue_type_ids_item)



        option_ids: list[str] | Unset = UNSET
        if not isinstance(self.option_ids, Unset):
            option_ids = []
            for option_ids_item_data in self.option_ids:
                option_ids_item = str(option_ids_item_data)
                option_ids.append(option_ids_item)



        default_value: bool | float | list[str] | None | str | Unset
        if isinstance(self.default_value, Unset):
            default_value = UNSET
        elif isinstance(self.default_value, list):
            default_value = []
            for default_value_type_3_item_data in self.default_value:
                default_value_type_3_item = str(default_value_type_3_item_data)
                default_value.append(default_value_type_3_item)


        elif isinstance(self.default_value, list):
            default_value = self.default_value


        else:
            default_value = self.default_value

        tab: None | str | Unset
        if isinstance(self.tab, Unset):
            tab = UNSET
        else:
            tab = self.tab


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if required is not UNSET:
            field_dict["required"] = required
        if hidden is not UNSET:
            field_dict["hidden"] = hidden
        if description is not UNSET:
            field_dict["description"] = description
        if issue_type_ids is not UNSET:
            field_dict["issueTypeIds"] = issue_type_ids
        if option_ids is not UNSET:
            field_dict["optionIds"] = option_ids
        if default_value is not UNSET:
            field_dict["defaultValue"] = default_value
        if tab is not UNSET:
            field_dict["tab"] = tab

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        required = d.pop("required", UNSET)

        hidden = d.pop("hidden", UNSET)

        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        _issue_type_ids = d.pop("issueTypeIds", UNSET)
        issue_type_ids: list[UUID] | Unset = UNSET
        if _issue_type_ids is not UNSET:
            issue_type_ids = []
            for issue_type_ids_item_data in _issue_type_ids:
                issue_type_ids_item = UUID(issue_type_ids_item_data)



                issue_type_ids.append(issue_type_ids_item)


        _option_ids = d.pop("optionIds", UNSET)
        option_ids: list[UUID] | Unset = UNSET
        if _option_ids is not UNSET:
            option_ids = []
            for option_ids_item_data in _option_ids:
                option_ids_item = UUID(option_ids_item_data)



                option_ids.append(option_ids_item)


        def _parse_default_value(data: object) -> bool | float | list[str] | list[UUID] | None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                default_value_type_3 = []
                _default_value_type_3 = data
                for default_value_type_3_item_data in (_default_value_type_3):
                    default_value_type_3_item = UUID(default_value_type_3_item_data)



                    default_value_type_3.append(default_value_type_3_item)

                return default_value_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                default_value_type_4 = cast(list[str], data)

                return default_value_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(bool | float | list[str] | list[UUID] | None | str | Unset, data)

        default_value = _parse_default_value(d.pop("defaultValue", UNSET))


        def _parse_tab(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        tab = _parse_tab(d.pop("tab", UNSET))


        project_field_setting = cls(
            required=required,
            hidden=hidden,
            description=description,
            issue_type_ids=issue_type_ids,
            option_ids=option_ids,
            default_value=default_value,
            tab=tab,
        )


        project_field_setting.additional_properties = d
        return project_field_setting

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
