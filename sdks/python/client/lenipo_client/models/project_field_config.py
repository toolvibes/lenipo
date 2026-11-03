from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="ProjectFieldConfig")



@_attrs_define
class ProjectFieldConfig:
    """ 
        Attributes:
            required (bool):  Default: False.
            hidden (bool):  Default: False.
            description (None | str):
            issue_type_ids (list[UUID]):
            option_ids (list[UUID]):
            default_value (bool | float | list[str] | list[UUID] | None | str):
            tab (None | str):
            field_id (UUID):
     """

    description: None | str
    issue_type_ids: list[UUID]
    option_ids: list[UUID]
    default_value: bool | float | list[str] | list[UUID] | None | str
    tab: None | str
    field_id: UUID
    required: bool = False
    hidden: bool = False





    def to_dict(self) -> dict[str, Any]:
        required = self.required

        hidden = self.hidden

        description: None | str
        description = self.description

        issue_type_ids = []
        for issue_type_ids_item_data in self.issue_type_ids:
            issue_type_ids_item = str(issue_type_ids_item_data)
            issue_type_ids.append(issue_type_ids_item)



        option_ids = []
        for option_ids_item_data in self.option_ids:
            option_ids_item = str(option_ids_item_data)
            option_ids.append(option_ids_item)



        default_value: bool | float | list[str] | None | str
        if isinstance(self.default_value, list):
            default_value = []
            for default_value_type_3_item_data in self.default_value:
                default_value_type_3_item = str(default_value_type_3_item_data)
                default_value.append(default_value_type_3_item)


        elif isinstance(self.default_value, list):
            default_value = self.default_value


        else:
            default_value = self.default_value

        tab: None | str
        tab = self.tab

        field_id = str(self.field_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "required": required,
            "hidden": hidden,
            "description": description,
            "issueTypeIds": issue_type_ids,
            "optionIds": option_ids,
            "defaultValue": default_value,
            "tab": tab,
            "fieldId": field_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        required = d.pop("required")

        hidden = d.pop("hidden")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        issue_type_ids = []
        _issue_type_ids = d.pop("issueTypeIds")
        for issue_type_ids_item_data in (_issue_type_ids):
            issue_type_ids_item = UUID(issue_type_ids_item_data)



            issue_type_ids.append(issue_type_ids_item)


        option_ids = []
        _option_ids = d.pop("optionIds")
        for option_ids_item_data in (_option_ids):
            option_ids_item = UUID(option_ids_item_data)



            option_ids.append(option_ids_item)


        def _parse_default_value(data: object) -> bool | float | list[str] | list[UUID] | None | str:
            if data is None:
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
            return cast(bool | float | list[str] | list[UUID] | None | str, data)

        default_value = _parse_default_value(d.pop("defaultValue"))


        def _parse_tab(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        tab = _parse_tab(d.pop("tab"))


        field_id = UUID(d.pop("fieldId"))




        project_field_config = cls(
            required=required,
            hidden=hidden,
            description=description,
            issue_type_ids=issue_type_ids,
            option_ids=option_ids,
            default_value=default_value,
            tab=tab,
            field_id=field_id,
        )

        return project_field_config

