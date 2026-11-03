from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.update_custom_field_request_options_item import UpdateCustomFieldRequestOptionsItem





T = TypeVar("T", bound="UpdateCustomFieldRequest")



@_attrs_define
class UpdateCustomFieldRequest:
    """ 
        Attributes:
            name (str | Unset):
            description (str | Unset):
            options (list[UpdateCustomFieldRequestOptionsItem] | Unset):
            archived (bool | Unset):
     """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    options: list[UpdateCustomFieldRequestOptionsItem] | Unset = UNSET
    archived: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_custom_field_request_options_item import UpdateCustomFieldRequestOptionsItem # noqa: PLC0415
        name = self.name

        description = self.description

        options: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.options, Unset):
            options = []
            for options_item_data in self.options:
                options_item = options_item_data.to_dict()
                options.append(options_item)



        archived = self.archived


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if options is not UNSET:
            field_dict["options"] = options
        if archived is not UNSET:
            field_dict["archived"] = archived

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_custom_field_request_options_item import UpdateCustomFieldRequestOptionsItem # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        _options = d.pop("options", UNSET)
        options: list[UpdateCustomFieldRequestOptionsItem] | Unset = UNSET
        if _options is not UNSET:
            options = []
            for options_item_data in _options:
                options_item = UpdateCustomFieldRequestOptionsItem.from_dict(options_item_data)



                options.append(options_item)


        archived = d.pop("archived", UNSET)

        update_custom_field_request = cls(
            name=name,
            description=description,
            options=options,
            archived=archived,
        )


        update_custom_field_request.additional_properties = d
        return update_custom_field_request

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
